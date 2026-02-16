import { addToast, ToastVariantProps } from "@heroui/react"
import { useCallback } from "react"

export const useToasts = () => {
    const showToast = useCallback((description: string, variant: ToastVariantProps['color'], title: string) => {
        return addToast({
            title,
            description,
            color: variant,
            classNames: {
                title: 'text-lg font-bold',
                description: 'text-md'
            },
            shadow: 'lg',
            shouldShowTimeoutProgress: true
        })
    }, [])

    return {
        showToast
    }
}