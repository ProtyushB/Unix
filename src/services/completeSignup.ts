import { FolderService } from '../backend/dms/service/folder.service';
import {
  createRoleFolders,
  createBusinessDmsFolders,
  BusinessFolderResult,
} from '../backend/dms/util/BusinessFolderUtils';
import { getPersonService } from '../backend/person/provider/person.provider';
import { getAuthService } from '../backend/auth/provider/auth.provider';
import { setDmsFolderMap, DmsFolderMap } from '../storage/dms.storage';
import {
  setCompleteProfileData,
  setUserProfile,
  setBusinessTypeMap,
} from '../storage/session.storage';
import { setLoggedInUser } from '../storage/auth.storage';
import type { ClaimContext } from '../context/SignupDraftContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * The one place an account is actually created.
 *
 * Both endings of the signup flow land here — the customer path from the review
 * screen, the business path from the payment screen — so the ordering and, more
 * importantly, the rollback live in a single place. When this was inline in the
 * review screen there was no way to add the payment step without copying the
 * rollback, and a copied rollback is a rollback that drifts.
 *
 * Sequence: auth signup → DMS folders → person (create or claim) → cache. If
 * any step after the auth user fails, everything already made is undone so the
 * user can retry from a clean slate.
 */

export interface SignupPersonal {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
}

export interface CompleteSignupInput {
  personal: SignupPersonal;
  businesses: any[];
  password: string;
  /** Present when the post-OTP triage matched a walk-in — claim instead of create. */
  claim?: ClaimContext | null;
  /** Durable OTP proof from the verify step; validates signup past the 10-min flag. */
  verificationToken?: string | null;
  /** Collected on the payment step; stamped onto every business. */
  employeeCode?: string;
  couponCode?: string | null;
}

export type CompleteSignupResult =
  | { ok: true }
  | { ok: false; error: string; verificationExpired?: boolean };

/**
 * The signup step rejects with one of these when the OTP proof is gone — token
 * expired, or the legacy flag lapsed. The caller bounces back to re-verify
 * rather than showing a dead-end error.
 */
export function isVerificationError(message?: string): boolean {
  return /not verified|verification (has )?expired|verify your email/i.test(message || '');
}

export async function completeSignup(input: CompleteSignupInput): Promise<CompleteSignupResult> {
  const { personal, businesses, password, claim } = input;
  const hasBusiness = businesses && businesses.length > 0;

  const authService = getAuthService();
  const personService = getPersonService();
  const folderService = new FolderService();

  let signupCompleted = false;
  let authUserId: number | null = null;
  let userRootFolderId: number | null = null;
  let personCreated = false;

  const rollback = async () => {
    if (userRootFolderId) {
      await folderService
        .deleteFolder(userRootFolderId)
        .catch(e => console.warn('[completeSignup] rollback folder delete failed:', e?.message));
    }
    if (signupCompleted) {
      if (authUserId !== null) {
        await authService
          .deleteUser(authUserId)
          .catch(e => console.warn('[completeSignup] rollback auth delete failed:', e?.message));
      }
      await authService.logout();
    }
  };

  try {
    // ── A: auth user ─────────────────────────────────────────────────────────
    await authService.signup({
      username: personal.username,
      email: personal.email,
      password,
      roles: ['CUSTOMER'],
      // The durable proof — lets signup succeed past the 10-min Redis flag.
      ...(input.verificationToken ? { verificationToken: input.verificationToken } : {}),
    });
    signupCompleted = true;

    const authUser = await authService.getUserByUsername(personal.username);
    authUserId = authUser.id;

    // ── B: DMS folders ───────────────────────────────────────────────────────
    const userFolder = await folderService.createFolder({
      folderName: `${personal.username}_${uuidv4()}`,
    });
    userRootFolderId = userFolder.folderId!;

    const roleFolders = await createRoleFolders(userRootFolderId);

    const businessFolderResults: BusinessFolderResult[] = [];
    if (hasBusiness) {
      for (const biz of businesses) {
        businessFolderResults.push(
          await createBusinessDmsFolders(null, biz.businessName, roleFolders.Business),
        );
      }
    }

    // Payment codes are stamped onto every business created in this session.
    const businessPayload = hasBusiness
      ? businesses.map((biz: any, idx: number) => ({
          businessName: biz.businessName,
          businessType: biz.businessType,
          businessPhone: biz.businessPhone || null,
          businessEmail: biz.businessEmail || null,
          registration: {
            cin: biz.cin || null,
            gstin: biz.gstin || null,
            pan: biz.pan || null,
          },
          folderId: businessFolderResults[idx]?.folderId ?? null,
          businessRoles: [],
          isActive: true,
          ...(input.employeeCode ? { salesEmployeeCode: input.employeeCode } : {}),
          ...(input.couponCode ? { couponCode: input.couponCode } : {}),
        }))
      : [];

    // ── C: person — claim an existing walk-in, or create a new one ───────────
    // A walk-in already exists in ModuleX; inserting again would 409 on the
    // duplicate email/phone. The claim links it, swaps the username, attaches
    // every business and grants BUSINESS_OWNER in ONE transaction.
    const result = claim
      ? await personService.claimCustomer({
          username: personal.username,
          firstName: personal.firstName,
          lastName: personal.lastName,
          phoneNumber: personal.phoneNumber,
          businesses: businessPayload,
        })
      : await personService.createPerson({
          firstName: personal.firstName,
          lastName: personal.lastName,
          userName: personal.username,
          email: personal.email,
          phoneNumber: personal.phoneNumber,
          personFolderId: userRootFolderId,
          businesses: businessPayload,
        } as any);

    if (!result.success || !result.data) {
      await rollback();
      return { ok: false, error: result.error || 'Something went wrong. Please try again.' };
    }
    personCreated = true;

    // ── D: cache what the portals need ───────────────────────────────────────
    const registeredUser = result.data as any;

    await setLoggedInUser({
      id: registeredUser.id || 0,
      username: personal.username,
      roles: registeredUser.types || [],
      email: personal.email,
    });
    await setUserProfile(registeredUser);
    await setCompleteProfileData({
      person: registeredUser,
      businesses: registeredUser.business || businesses,
    });

    if (hasBusiness && registeredUser.business?.length > 0) {
      const typeMap: Record<string, any[]> = {};
      (registeredUser.business as any[]).forEach((biz: any) => {
        const type = biz.businessType || 'CUSTOM';
        if (!typeMap[type]) typeMap[type] = [];
        typeMap[type].push(biz);
      });
      await setBusinessTypeMap(typeMap);
    }

    const dmsFolderMapData: DmsFolderMap = {
      userRootFolderId,
      roleFolders: {
        Business: roleFolders.Business,
        Customer: roleFolders.Customer,
        Employee: roleFolders.Employee,
      },
      businesses: {},
    };
    if (hasBusiness && registeredUser.business) {
      (registeredUser.business as any[]).forEach((biz: any, idx: number) => {
        const bizId = biz.id || idx;
        if (businessFolderResults[idx]) {
          dmsFolderMapData.businesses[bizId] = businessFolderResults[idx];
        }
      });
    }
    await setDmsFolderMap(dmsFolderMapData);

    return { ok: true };
  } catch (err: any) {
    if (!personCreated) await rollback();

    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Something went wrong. Please try again.';

    return { ok: false, error: message, verificationExpired: isVerificationError(message) };
  }
}
