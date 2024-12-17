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

export function onlyUnique(value: any, index: number, array: Array<any>): boolean {
    return array.indexOf(value) === index
}

export function onlyUniqueBy(extractor: (value: any) => any): (value: any) => boolean {
    const seen = new Set()
    return (value: any): boolean => {
        const extracted = extractor(value)
        if (seen.has(extracted)) {
            return false
        } else {
            seen.add(extracted)
            return true
        }
    }
}
