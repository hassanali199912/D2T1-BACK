import { Policy } from './entity/policy.entity.js';
import { PolicyLanguage } from './policy-language.js';
import { PolicyType } from './policy-type.js';

export type NewPolicy = {
  name: string;
  type: PolicyType;
  description: string | null;
  version: string;
  language: PolicyLanguage;
  effectiveFrom: string;
  effectiveTo: string | null;
  documentUrl: string;
};

export type PolicyIdentity = {
  name: string;
  version: string;
  language: PolicyLanguage;
};

export abstract class PoliciesRepository {
  abstract create(policy: NewPolicy): Promise<Policy>;
  abstract findAll(): Promise<Policy[]>;
  abstract findById(id: string): Promise<Policy | null>;
  abstract findByIdentity(identity: PolicyIdentity): Promise<Policy | null>;
  abstract deleteById(id: string): Promise<void>;
}
