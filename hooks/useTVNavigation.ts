import { useEffect } from 'react';

export const useTVNavigation = () => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Get all focusable elements
            const focusableElements = Array.from(
                document.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            );

            const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

            // Helper to focus and scroll into view
            const focusElement = (element: HTMLElement) => {
                element.focus();
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            };

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    if (currentIndex < focusableElements.length - 1) {
                        focusElement(focusableElements[currentIndex + 1]);
                    }
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        focusElement(focusableElements[currentIndex - 1]);
                    }
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    // Find next row (approximate by skipping multiple elements)
                    const nextRowIndex = Math.min(currentIndex + 5, focusableElements.length - 1);
                    focusElement(focusableElements[nextRowIndex]);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    // Find previous row
                    const prevRowIndex = Math.max(currentIndex - 5, 0);
                    focusElement(focusableElements[prevRowIndex]);
                    break;

                case 'Enter':
                    // Let default behavior handle clicks
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.click();
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    // Close modals or go back
                    const closeButton = document.querySelector<HTMLElement>('[aria-label="Close"], .close-button');
                    closeButton?.click();
                    break;

                case 'Backspace':
                    // Only close modal if not in an input field
                    const activeElement = document.activeElement;
                    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                        // Let backspace work normally in input fields
                        return;
                    }
                    e.preventDefault();
                    // Close modals
                    const backButton = document.querySelector<HTMLElement>('[aria-label="Close"], .close-button');
                    backButton?.click();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);
};
