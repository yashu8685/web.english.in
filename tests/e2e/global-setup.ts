import { prepareTestDatabase } from "../../../api/scripts/test-db.ts";

export default async function setup(): Promise<void> {
  await prepareTestDatabase();
}
