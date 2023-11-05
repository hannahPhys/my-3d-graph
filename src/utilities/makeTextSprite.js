import * as THREE from 'three';

export const makeTextSprite = (message) => {
    const fontface = 'Arial';
    const fontsize = 12;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontsize}px ${fontface}`;

    // Get text metrics
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    // Set canvas dimensions dynamically
    const padding = 10; // Extra padding around the text
    canvas.width = textWidth + padding;
    canvas.height = fontsize + padding;

    // Re-apply text to fill canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontsize}px ${fontface}`;
    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.fillText(message, padding / 2, fontsize + padding / 2);

    // Create texture
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width / 10, canvas.height / 10, 1);

    return sprite;
};
