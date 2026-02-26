import { apiPost } from "./client";

interface LoginEvmResponse {
  access_token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

export function loginWithEvm(
  address: string,
  message: string,
  signature: string
): Promise<LoginEvmResponse> {
  return apiPost<LoginEvmResponse>("/api/auth/login/evm", {
    address,
    message,
    signature,
  });
}
