export interface Activity {
  id: string;
  type: string;
  status: string;
  txHash: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}
