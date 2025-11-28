import { Color3 } from "@babylonjs/core";

export class StressColorMapper {
    static getViridisColor(value: number, min: number, max: number): Color3 {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

        // Approximate Viridis colormap
        // 0.0 -> Purple, 0.5 -> Green/Teal, 1.0 -> Yellow
        // Simple interpolation for MVP
        if (t < 0.5) {
            // Purple (0.26, 0.0, 0.33) to Teal (0.13, 0.55, 0.55)
            return Color3.Lerp(new Color3(0.26, 0.0, 0.33), new Color3(0.13, 0.55, 0.55), t * 2);
        } else {
            // Teal to Yellow (0.99, 0.90, 0.14)
            return Color3.Lerp(new Color3(0.13, 0.55, 0.55), new Color3(0.99, 0.90, 0.14), (t - 0.5) * 2);
        }
    }

    static getTurboColor(value: number, min: number, max: number): Color3 {
        // Placeholder for Turbo, using Red-Blue for now
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return Color3.Lerp(new Color3(0, 0, 1), new Color3(1, 0, 0), t);
    }
}
