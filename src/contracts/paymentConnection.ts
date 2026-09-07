export type PaymentConnectionEnvironment = "sandbox" | "production";
export type PaymentConnectionState =
  | "unconfigured"
  | "draft"
  | "verification_pending"
  | "active"
  | "verification_failed"
  | "disabled";

export interface PaymentConnection {
  provider: "basgate";
  environment: PaymentConnectionEnvironment | null;
  state: PaymentConnectionState;
  revision: number;
  canAcceptOnlinePayments: boolean;
  lastVerificationCode: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

export interface BasGateCredentials {
  appId: string;
  merchantKey: string;
  clientId: string;
  clientSecret: string;
}

export interface ConfigureBasGateConnectionInput {
  environment: PaymentConnectionEnvironment;
  expectedRevision: number;
  credentials: BasGateCredentials;
}

export interface PaymentConnectionActions {
  load(tenantId: string, signal?: AbortSignal): Promise<PaymentConnection>;
  configure(
    tenantId: string,
    input: ConfigureBasGateConnectionInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<PaymentConnection>;
}
