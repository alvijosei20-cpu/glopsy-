import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareJsonFile(fileName: string, json: string, title: string): Promise<boolean> {
  const tmp = new File(Paths.cache, fileName);
  if (!tmp.exists) tmp.create();
  tmp.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(tmp.uri, { mimeType: 'application/json', dialogTitle: title, UTI: 'public.json' });
  return true;
}
