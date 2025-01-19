import { hasNotEmptyIntersection } from './utils.js'

describe(hasNotEmptyIntersection.name, () => {

    it('both empty', () => {
        expect(hasNotEmptyIntersection([], [])).toBe(false)
        expect(hasNotEmptyIntersection([], null)).toBe(false)
        expect(hasNotEmptyIntersection([], undefined)).toBe(false)
        expect(hasNotEmptyIntersection(null, [])).toBe(false)
        expect(hasNotEmptyIntersection(null, null)).toBe(false)
        expect(hasNotEmptyIntersection(null, undefined)).toBe(false)
        expect(hasNotEmptyIntersection(undefined, [])).toBe(false)
        expect(hasNotEmptyIntersection(undefined, null)).toBe(false)
        expect(hasNotEmptyIntersection(undefined, undefined)).toBe(false)
    })

    it('left empty', () => {
        expect(hasNotEmptyIntersection([], ['a', 'b'])).toBe(false)
        expect(hasNotEmptyIntersection(null, ['a', 'b'])).toBe(false)
        expect(hasNotEmptyIntersection(undefined, ['a', 'b'])).toBe(false)
    })

    it('right empty', () => {
        expect(hasNotEmptyIntersection(['a', 'b'], [])).toBe(false)
        expect(hasNotEmptyIntersection(['a', 'b'], null)).toBe(false)
        expect(hasNotEmptyIntersection(['a', 'b'], undefined)).toBe(false)
    })

    it('no intersection', () => {
        expect(hasNotEmptyIntersection(['a', 'b'], ['c', 'd'])).toBe(false)
    })

    it('partial intersection', () => {
        expect(hasNotEmptyIntersection(['a', 'b'], ['b', 'c'])).toBe(true)
    })

    it('full intersection', () => {
        expect(hasNotEmptyIntersection(['a', 'b'], ['a', 'b'])).toBe(true)
    })

})
