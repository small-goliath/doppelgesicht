/**
 * OS 키체인 통합 모듈
 * macOS/Windows/Linux 키체인 저장소 연동
 */

import keytar from 'keytar';

// 키체인 서비스 이름
const SERVICE_NAME = 'doppelgesicht';
const MASTER_KEY_ACCOUNT = 'master-key-hash';

/**
 * 키체인 저장 결과 인터페이스
 */
export interface KeychainResult {
  success: boolean;
  error?: string;
}

/**
 * 마스터 키 해시를 OS 키체인에 저장합니다
 * @param hash - 저장할 마스터 키 해시
 * @returns 저장 결과
 */
export async function storeMasterKeyHash(hash: string): Promise<KeychainResult> {
  try {
    await keytar.setPassword(SERVICE_NAME, MASTER_KEY_ACCOUNT, hash);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error storing master key hash',
    };
  }
}

/**
 * OS 키체인에서 마스터 키 해시를 가져옵니다
 * @returns 저장된 해시 또는 null
 */
export async function getMasterKeyHash(): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, MASTER_KEY_ACCOUNT);
  } catch (error) {
    return null;
  }
}

/**
 * OS 키체인에서 마스터 키 해시를 삭제합니다
 * @returns 삭제 결과
 */
export async function deleteMasterKeyHash(): Promise<KeychainResult> {
  try {
    const result = await keytar.deletePassword(SERVICE_NAME, MASTER_KEY_ACCOUNT);
    return { success: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting master key hash',
    };
  }
}

/**
 * 키체인에 마스터 키가 저장되어 있는지 확인합니다
 * @returns 저장 여부
 */
export async function hasMasterKeyHash(): Promise<boolean> {
  const hash = await getMasterKeyHash();
  return hash !== null;
}

/**
 * 자격 증명을 키체인에 저장합니다
 * @param account - 계정 식별자
 * @param credential - 저장할 자격 증명
 * @returns 저장 결과
 */
export async function storeCredential(
  account: string,
  credential: string
): Promise<KeychainResult> {
  try {
    await keytar.setPassword(SERVICE_NAME, account, credential);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error storing credential',
    };
  }
}

/**
 * 키체인에서 자격 증명을 가져옵니다
 * @param account - 계정 식별자
 * @returns 저장된 자격 증명 또는 null
 */
export async function getCredential(account: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, account);
  } catch (error) {
    return null;
  }
}

/**
 * 키체인에서 자격 증명을 삭제합니다
 * @param account - 계정 식별자
 * @returns 삭제 결과
 */
export async function deleteCredential(account: string): Promise<KeychainResult> {
  try {
    const result = await keytar.deletePassword(SERVICE_NAME, account);
    return { success: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting credential',
    };
  }
}

/**
 * 저장된 모든 계정 목록을 가져옵니다
 * @returns 계정 식별자 배열
 */
export async function getAllAccounts(): Promise<string[]> {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    return credentials.map((cred) => cred.account);
  } catch (error) {
    return [];
  }
}

/**
 * 키체인 사용 가능 여부를 확인합니다
 * @returns 사용 가능 여부
 */
export async function isKeychainAvailable(): Promise<boolean> {
  try {
    // 테스트 저장/삭제로 키체인 접근 가능 여부 확인
    const testAccount = '_test_keychain_access_';
    await keytar.setPassword(SERVICE_NAME, testAccount, 'test');
    await keytar.deletePassword(SERVICE_NAME, testAccount);
    return true;
  } catch (error) {
    return false;
  }
}
