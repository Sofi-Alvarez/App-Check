// Exportar la copia de seguridad completa: se arma, se verifica contra sí misma y recién entonces se comparte, en
// partes. Si algo no cuadra no se comparte nada. Devuelve el mensaje para mostrar. Lo usan Ajustes y la pantalla de
// datos dañados (por eso lee las claves crudas, sin interpretar la agenda).

import { Share } from 'react-native';
import { buildBackupParts, parseBackupParts, sizeLabel } from './domain/backup';
import { S } from './i18n';
import { loadAllEntries } from './store';

const T = S.settings;

export async function shareBackup(): Promise<string> {
  const entries = loadAllEntries();
  if (!entries) return T.backupReadError;
  if (entries.length === 0) return T.backupEmpty;
  const parts = buildBackupParts(entries, new Date());
  const check = parseBackupParts(parts);
  if (!check.ok || check.entries.length !== entries.length) return T.backupVerifyError;
  const label = T.backupLabel(entries.length, sizeLabel(parts));
  let sent = 0;
  try {
    for (let i = 0; i < parts.length; i++) {
      const r = await Share.share({ title: T.backupPartTitle(i + 1, parts.length), message: parts[i] });
      if (r.action === Share.dismissedAction) break;
      sent++;
    }
  } catch {
    return T.backupInterrupted(sent, parts.length);
  }
  return sent === parts.length ? T.backupDone(label, parts.length) : T.backupPartial(sent, parts.length);
}
