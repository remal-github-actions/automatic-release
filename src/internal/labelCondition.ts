export type LabelCondition = (label: string) => boolean

export function parseLabelCondition(string: string): LabelCondition {
    if (string.length > 3 && string.startsWith('!/') && string.endsWith('/')) {
        const condition = parseLabelCondition(string.substring(1))
        return label => !condition(label)
    }

    if (string.length > 2 && string.startsWith('/') && string.endsWith('/')) {
        const regex = new RegExp(string.substring(1, string.length - 1))
        return label => regex.test(label)
    }

    return label => label === string
}
