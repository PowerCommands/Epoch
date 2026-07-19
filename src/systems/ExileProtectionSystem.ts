export type ExileProtectionResponse = 'deny' | 'accept_free' | 'accept_gold' | 'accept_resource';

export interface ExileProtectionTribute {
  type: 'gold' | 'resource';
  resourceId?: string;
  amountPerTurn?: number;
  goldPerTurn?: number;
}

/**
 * Legacy save-shape only. Leader exile protection is retired; new runtime state
 * never creates or restores these agreements.
 */
export interface ExileProtectionAgreement {
  protectedNationId: string;
  protectorNationId: string;
  enemyNationId: string;
  turnsRemaining: number;
  tribute?: ExileProtectionTribute;
}

export interface ExileProtectionRequest {
  protectedNationId: string;
  protectorNationId: string;
  enemyNationId: string;
}

export interface ExileProtectionChoiceRequest extends ExileProtectionRequest {
  acceptFree: () => void;
  acceptGold: () => void;
  acceptResource: () => void;
  deny: () => void;
}

export interface ExileProtectionEvent {
  agreement?: ExileProtectionAgreement;
  request: ExileProtectionRequest;
  response: ExileProtectionResponse;
  message: string;
}

type ChoiceListener = (request: ExileProtectionChoiceRequest) => void;
type EventListener = (event: ExileProtectionEvent) => void;

export class ExileProtectionSystem {
  constructor(..._args: unknown[]) {}

  onChoiceRequested(_listener: ChoiceListener): void {}

  onGranted(_listener: EventListener): void {}

  onDenied(_listener: EventListener): void {}

  onExpired(_listener: EventListener): void {}

  getAllAgreements(): ExileProtectionAgreement[] {
    return [];
  }

  restoreAgreements(_agreements: readonly ExileProtectionAgreement[] | undefined): void {}

  cancelAgreementsForNation(_nationId: string): number {
    return 0;
  }
}
