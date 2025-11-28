import { MaterialProperties } from "../types";

export class IsotropicMaterial implements MaterialProperties {
    name: string;
    E: number;
    nu: number;
    rho: number;
    G: number;

    constructor(name: string, E: number, nu: number, rho: number) {
        this.name = name;
        this.E = E;
        this.nu = nu;
        this.rho = rho;
        this.G = E / (2 * (1 + nu));
    }

    static Steel(): IsotropicMaterial {
        return new IsotropicMaterial("Steel", 210e9, 0.3, 7850);
    }

    static Aluminum(): IsotropicMaterial {
        return new IsotropicMaterial("Aluminum", 69e9, 0.33, 2700);
    }

    static Titanium(): IsotropicMaterial {
        return new IsotropicMaterial("Titanium", 116e9, 0.32, 4500);
    }
}
