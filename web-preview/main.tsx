import { AppRegistry } from 'react-native';
import { PreviewApp } from './PreviewApp';

// Mount through AppRegistry (not ReactDOM directly) so react-native-web installs
// its StyleSheet registry and the RN reset the screens rely on.
AppRegistry.registerComponent('UnixPreview', () => PreviewApp);
AppRegistry.runApplication('UnixPreview', {
  rootTag: document.getElementById('root'),
});
