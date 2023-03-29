export function hasNotEmptyIntersection<T>(array1: T[] | null | undefined, array2: T[] | null | undefined): boolean {
    if (array1 == null || !array1.length) {
        return false
    }
    if (array2 == null || !array2.length) {
        return false
    }

    for (const element1 of array1) {
        if (!array2.includes(element1)) {
            return false
        }
    }

    return true
}
