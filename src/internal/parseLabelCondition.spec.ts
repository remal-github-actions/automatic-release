import { parseLabelCondition } from './labelCondition.js'

describe(parseLabelCondition.name, () => {

    it('string', () => {
        const condition = parseLabelCondition('123')
        expect(condition('123')).toBe(true)
        expect(condition('23')).toBe(false)
        expect(condition('0123')).toBe(false)
        expect(condition('1234')).toBe(false)
        expect(condition('01234')).toBe(false)
    })

    it('regex', () => {
        const condition = parseLabelCondition('/123/')
        expect(condition('123')).toBe(true)
        expect(condition('23')).toBe(false)
        expect(condition('0123')).toBe(true)
        expect(condition('1234')).toBe(true)
        expect(condition('01234')).toBe(true)
    })

    it('negated regex', () => {
        const condition = parseLabelCondition('!/123/')
        expect(condition('123')).toBe(false)
        expect(condition('23')).toBe(true)
        expect(condition('0123')).toBe(false)
        expect(condition('1234')).toBe(false)
        expect(condition('01234')).toBe(false)
    })

})
