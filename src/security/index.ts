/**
 * 보안 모듈 메인 exports
 */

// 마스터 키 파생
export {
  deriveMasterKey,
  verifyAndRecoverKey,
  clearMasterKey,
  validatePasswordComplexity,
  type MasterKeyResult,
} from './master-key.js';

// 암호화/복호화
export {
  encrypt,
  decrypt,
  encryptString,
  decryptToString,
  serializeEncryptedData,
  deserializeEncryptedData,
  type EncryptedData,
} from './crypto.js';

// 키체인 통합
export {
  storeMasterKeyHash,
  getMasterKeyHash,
  deleteMasterKeyHash,
  hasMasterKeyHash,
  storeCredential,
  getCredential,
  deleteCredential,
  getAllAccounts,
  isKeychainAvailable,
  type KeychainResult,
} from './keychain.js';
