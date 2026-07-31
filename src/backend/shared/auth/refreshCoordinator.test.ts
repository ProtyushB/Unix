import {
  RefreshCoordinator,
  shouldSkipRefresh,
  type RefreshDeps,
  type RefreshTokens,
} from './refreshCoordinator';

/** A refresh whose resolution we control, so concurrency is deterministic rather than timed. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeDeps(over: Partial<RefreshDeps> = {}) {
  const saved: RefreshTokens[] = [];
  const deps: RefreshDeps = {
    getRefreshToken: jest.fn(async () => 'refresh-1'),
    setTokens: jest.fn(async (t: RefreshTokens) => {
      saved.push(t);
    }),
    postRefresh: jest.fn(async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
    ...over,
  };
  return { deps, saved };
}

describe('single flight', () => {
  // The whole point: five requests hitting an expired token must cost one round trip. With
  // rotation, extra refreshes present an already-dead token and log the user out.
  it('shares one refresh across concurrent callers', async () => {
    const gate = deferred<RefreshTokens>();
    const { deps } = makeDeps({ postRefresh: jest.fn(() => gate.promise) });
    const c = new RefreshCoordinator(deps);

    const all = Promise.all([c.refresh(), c.refresh(), c.refresh(), c.refresh(), c.refresh()]);
    gate.resolve({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    expect(await all).toEqual(Array(5).fill('access-2'));
    expect(deps.postRefresh).toHaveBeenCalledTimes(1);
    expect(deps.setTokens).toHaveBeenCalledTimes(1);
  });

  it('rejects every concurrent caller when the refresh fails', async () => {
    const gate = deferred<RefreshTokens>();
    const { deps } = makeDeps({ postRefresh: jest.fn(() => gate.promise) });
    const c = new RefreshCoordinator(deps);

    const a = c.refresh();
    const b = c.refresh();
    gate.reject(new Error('boom'));

    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(deps.postRefresh).toHaveBeenCalledTimes(1);
  });

  // The in-flight promise is cleared in `finally`, not on success — otherwise one failure would
  // pin a rejected promise and every later 401 would fail without even trying.
  it('starts a fresh attempt after a failure', async () => {
    const postRefresh = jest
      .fn<Promise<RefreshTokens>, [string]>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ accessToken: 'access-3' });
    const { deps } = makeDeps({ postRefresh });
    const c = new RefreshCoordinator(deps);

    await expect(c.refresh()).rejects.toThrow('transient');
    await expect(c.refresh()).resolves.toBe('access-3');
    expect(postRefresh).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh flight once the previous one settled', async () => {
    const { deps } = makeDeps();
    const c = new RefreshCoordinator(deps);

    await c.refresh();
    await c.refresh();

    expect(deps.postRefresh).toHaveBeenCalledTimes(2);
  });
});

describe('token persistence', () => {
  it('stores the rotated pair', async () => {
    const { deps, saved } = makeDeps();
    await new RefreshCoordinator(deps).refresh();
    expect(saved).toEqual([{ accessToken: 'access-2', refreshToken: 'refresh-2' }]);
  });

  // An unconditional write would clobber a valid refresh token with undefined the first time the
  // server declines to rotate, logging the user out on the very next 401.
  it('leaves the stored refresh token alone when the server omits it', async () => {
    const { deps, saved } = makeDeps({
      postRefresh: jest.fn(async () => ({ accessToken: 'access-2' })),
    });
    await new RefreshCoordinator(deps).refresh();
    expect(saved).toEqual([{ accessToken: 'access-2' }]);
    expect(saved[0]).not.toHaveProperty('refreshToken');
  });

  it('fails without persisting when there is no refresh token to start from', async () => {
    const { deps } = makeDeps({ getRefreshToken: jest.fn(async () => null) });
    await expect(new RefreshCoordinator(deps).refresh()).rejects.toThrow('No refresh token');
    expect(deps.postRefresh).not.toHaveBeenCalled();
    expect(deps.setTokens).not.toHaveBeenCalled();
  });

  it('fails without persisting when the response has no access token', async () => {
    const { deps } = makeDeps({
      postRefresh: jest.fn(async () => ({}) as RefreshTokens),
    });
    await expect(new RefreshCoordinator(deps).refresh()).rejects.toThrow('missing accessToken');
    expect(deps.setTokens).not.toHaveBeenCalled();
  });
});

describe('shouldSkipRefresh', () => {
  // Without this a bad password 401s, triggers a refresh, and the failure path logs the user out
  // instead of showing "wrong credentials".
  it('skips the auth endpoints', () => {
    expect(shouldSkipRefresh('/auth/login')).toBe(true);
    expect(shouldSkipRefresh('/auth/signup')).toBe(true);
    expect(shouldSkipRefresh('http://host:8085/auth/refresh')).toBe(true);
  });

  it('does not skip ordinary calls', () => {
    expect(shouldSkipRefresh('/parlourOrder/viewAll')).toBe(false);
    expect(shouldSkipRefresh('/auth-user/12')).toBe(false);
    expect(shouldSkipRefresh(undefined)).toBe(false);
  });
});
