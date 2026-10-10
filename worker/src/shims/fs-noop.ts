// Stand-in for node:fs inside server/src/data/prep.ts only. The Worker keeps the last prep bundle in memory
// (prep.ts already does); there is no disk to persist last-prep.json to.
const noop = async (..._args: unknown[]): Promise<undefined> => undefined;
export const promises = {
  mkdir: noop,
  writeFile: noop,
  readFile: async (..._args: unknown[]): Promise<string> => {
    throw new Error('no filesystem in the Worker');
  },
};
export default { promises };
