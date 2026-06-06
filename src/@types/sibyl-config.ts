/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */

import type { PluginType } from "./plugin.ts";

interface PluginConfig {
  name: string;
  type: PluginType;
}

export interface SibylConfig {
  plugins: PluginConfig[];
}
