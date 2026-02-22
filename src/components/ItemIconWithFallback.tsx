import { useState, useEffect } from 'react';
import { getMinecraftAssetUrl } from '@/lib/minecraftAssets';

interface ItemIconWithFallbackProps {
    itemName: string;
    displayName: string;
    className?: string;
    isBlock?: boolean;
    fallbackIcon?: string;
}

export function ItemIconWithFallback({
    itemName,
    displayName,
    className = "w-6 h-6 object-contain pixelated",
    isBlock = false,
    fallbackIcon = "📦"
}: ItemIconWithFallbackProps) {
    const [imgErr, setImgErr] = useState(false);
    const [triedFolder, setTriedFolder] = useState<'items' | 'blocks'>(isBlock ? 'blocks' : 'items');

    // Reset state when itemName changes
    useEffect(() => {
        setImgErr(false);
        setTriedFolder(isBlock ? 'blocks' : 'items');
    }, [itemName, isBlock]);

    const handleError = () => {
        if (triedFolder === 'items') {
            setTriedFolder('blocks');
        } else if (triedFolder === 'blocks') {
            // If was initially blocks, try items
            if (isBlock) {
                setTriedFolder('items');
            } else {
                setImgErr(true);
            }
        } else {
            setImgErr(true);
        }
    };

    if (imgErr) {
        return <div className={`flex items-center justify-center bg-white/5 rounded ${className}`}>{fallbackIcon}</div>;
    }

    return (
        <img
            src={getMinecraftAssetUrl(itemName, triedFolder)}
            alt={displayName}
            className={className}
            onError={handleError}
        />
    );
}
