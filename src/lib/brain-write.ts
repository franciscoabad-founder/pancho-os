/** Shared Phase 1 write contract. Keep in sync with Cortex apps/os/src/lib/brain-write.ts. */
export const BRAIN_WRITE_TAGS = ['braintech', 'cortex', 'taskr', 'rafik', 'arazza', 'codeis', 'kronek', 'fonquito', 'flow', 'os', 'panchoatlas', 'gbrain', 'hermes', 'n8n', 'vps', 'marca', 'personal', 'familia', 'salud', 'finanzas', 'contenido', 'gtm'] as const;
export type BrainWriteTag = (typeof BRAIN_WRITE_TAGS)[number];
export type BrainWriteActor = 'human' | 'nerio' | 'mentor' | 'system';
export type BrainWriteTarget = 'memory' | 'brain';
export type BrainWriteOperation = 'create' | 'update' | 'merge' | 'archive';
export type EvidenceSource = 'telegram' | 'os' | 'taski' | 'document' | 'calendar' | 'mentor' | 'user';
export interface BrainWriteEvidence { source: EvidenceSource; source_ref: string; quoted?: string; observed_at: string; confidence: 0 | 1 | 2; }
export interface BrainWriteClientInput { target: BrainWriteTarget; op: BrainWriteOperation; slug?: string; title: string; body: string; tags: string[]; wikilinks: string[]; evidence?: BrainWriteEvidence; dedupe_key: string; }
export interface BrainWrite extends Omit<BrainWriteClientInput, 'evidence'> { tenant_id: string; actor: BrainWriteActor; evidence: BrainWriteEvidence; bootstrap?: { reason: 'tenant_onboarding' }; }
export type BrainWriteValidation = { ok: true; value: BrainWrite } | { ok: false; issues: string[] };

export function bindBrainWriteToTenant(tenantId: string, actor: BrainWriteActor, input: BrainWriteClientInput, bootstrap?: BrainWrite['bootstrap']): BrainWrite {
  return { ...input, tenant_id: tenantId, actor, evidence: input.evidence as BrainWriteEvidence, bootstrap };
}

export function validateBrainWrite(write: BrainWrite): BrainWriteValidation {
  const issues: string[] = [];
  const brainCreate = write.target === 'brain' && write.op === 'create';
  if (!write.tenant_id.trim()) issues.push('tenant_id requerido desde el contexto del servidor');
  if (!['memory', 'brain'].includes(write.target)) issues.push('target debe ser memory o brain');
  if (!['create', 'update', 'merge', 'archive'].includes(write.op)) issues.push('op invalida');
  if (!write.title.trim()) issues.push('title requerido');
  if (!write.body.trim()) issues.push('body requerido');
  if (!write.dedupe_key.trim()) issues.push('dedupe_key requerido');
  if (!['telegram', 'os', 'taski', 'document', 'calendar', 'mentor', 'user'].includes(write.evidence?.source)) issues.push('evidence.source invalido');
  if (!write.evidence?.source_ref?.trim()) issues.push('evidence.source_ref requerido');
  if (!Number.isFinite(Date.parse(write.evidence?.observed_at ?? ''))) issues.push('evidence.observed_at debe ser ISO valido');
  if (write.evidence?.quoted && write.evidence.quoted.length > 500) issues.push('evidence.quoted no puede superar 500 caracteres');
  if (![0, 1, 2].includes(write.evidence?.confidence)) issues.push('evidence.confidence debe ser 0, 1 o 2');
  for (const tag of write.tags) if (!BRAIN_WRITE_TAGS.includes(tag as BrainWriteTag)) issues.push(`tag no permitido: ${tag}`);
  if (write.target === 'brain' && !write.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) issues.push('slug kebab-case requerido para Brain');
  if (brainCreate && write.evidence.confidence !== 2) issues.push('Brain create requiere evidence.confidence 2');
  if (brainCreate && write.wikilinks.length === 0 && !bootstrapAllowed(write)) issues.push('Brain create requiere al menos un wikilink existente');
  if (write.bootstrap && !bootstrapAllowed(write)) issues.push('bootstrap solo permite system en tenant_onboarding para Brain create');
  return issues.length ? { ok: false, issues } : { ok: true, value: write };
}

function bootstrapAllowed(write: BrainWrite): boolean { return write.target === 'brain' && write.op === 'create' && write.actor === 'system' && write.bootstrap?.reason === 'tenant_onboarding'; }
export async function createDedupeKey(tenantId: string, title: string, sourceRef: string): Promise<string> {
  const material = `${tenantId}\n${title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-EC')}\n${sourceRef.trim()}`;
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
