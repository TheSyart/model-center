import type { ProviderProtocol } from '@/lib/presets/types';
import type { ProviderFormEndpoint } from '@/lib/services/provider-form';

export interface ProviderEndpointView extends ProviderFormEndpoint {
  id?: string;
}

export interface ProviderView {
  id: string;
  slug: string;
  name: string;
  preset_key: string | null;
  protocol: ProviderProtocol;
  base_url: string;
  default_protocol: ProviderProtocol;
  default_base_url: string;
  endpoints: ProviderEndpointView[];
  enabled: boolean;
  priority: number;
  remark: string | null;
  has_key: boolean;
}

export interface ProviderFormState {
  id: string | null;
  preset_key: string | null;
  slug: string;
  name: string;
  api_key: string;
  remark: string;
  endpoints: ProviderFormEndpoint[];
}
