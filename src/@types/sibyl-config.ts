/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */

import type { PluginType } from "./plugin.ts";

export interface SibylConfig {
  plugins: Partial<Record<PluginType, string>>;
}
