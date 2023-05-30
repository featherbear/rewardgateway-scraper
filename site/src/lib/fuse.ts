
import Fuse from "fuse.js/dist/fuse.basic";
import type FuseType from "fuse.js/dist/fuse";

export function createFuse<T = any>(list: Array<T>, keys: (keyof T)[]) {
    return new (<typeof FuseType<T>>Fuse)([], {
        keys: keys satisfies (keyof T)[],
        findAllMatches: true,
    });

}
