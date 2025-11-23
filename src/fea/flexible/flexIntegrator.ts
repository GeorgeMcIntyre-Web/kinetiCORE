import * as numeric from 'numeric';
import { FlexibleBody } from './flexibleBody';

export class FlexIntegrator {
    private beta = 0.25;
    private gamma = 0.5;

    /**
     * Advances the flexible body state by one time step using Newmark-Beta method.
     * M * q_ddot + C * q_dot + K * q = F
     */
    public step(
        body: FlexibleBody,
        dt: number,
        externalForces: number[] // Reduced force vector (Phi^T * F_physical)
    ): void {
        const M = body.reducedModel.M_cb;
        const K = body.reducedModel.K_cb;
        // Rayleigh Damping: C = alpha*M + beta*K (Simplified)
        // For now, assume small proportional damping or modal damping
        const alpha = 0.01;
        const betaK = 0.001;

        // Construct C matrix (naive loop for MVP)
        const n = M.length;
        const C: number[][] = [];
        for (let i = 0; i < n; i++) {
            C[i] = [];
            for (let j = 0; j < n; j++) {
                C[i][j] = alpha * M[i][j] + betaK * K[i][j];
            }
        }

        const q = body.q;
        const q_dot = body.q_dot;
        const q_ddot = body.q_ddot;

        // Predictors
        // u_pred = u + dt*v + dt^2/2 * (1-2beta)*a
        // v_pred = v + dt*(1-gamma)*a

        const q_pred = new Array(n).fill(0);
        const q_dot_pred = new Array(n).fill(0);

        for (let i = 0; i < n; i++) {
            q_pred[i] = q[i] + dt * q_dot[i] + (0.5 * dt * dt * (1 - 2 * this.beta)) * q_ddot[i];
            q_dot_pred[i] = q_dot[i] + (dt * (1 - this.gamma)) * q_ddot[i];
        }

        // Solve for a_n+1
        // (M + gamma*dt*C + beta*dt^2*K) * a_n+1 = F - C*v_pred - K*u_pred

        // Effective Mass Matrix: M_eff
        const M_eff = numeric.add(
            M,
            numeric.add(
                numeric.mul(dt * this.gamma, C),
                numeric.mul(dt * dt * this.beta, K)
            )
        );

        // Effective Force: F_eff
        // F_eff = F_ext - C * q_dot_pred - K * q_pred
        const C_v_pred = numeric.dot(C, q_dot_pred);
        const K_u_pred = numeric.dot(K, q_pred);

        const F_eff = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            F_eff[i] = externalForces[i] - C_v_pred[i] - K_u_pred[i];
        }

        // Solve M_eff * q_ddot_next = F_eff
        // Invert M_eff (Precompute this if dt is constant!)
        const M_eff_inv = numeric.inv(M_eff);
        const q_ddot_next = numeric.dot(M_eff_inv, F_eff);

        // Correctors
        const q_next = new Array(n).fill(0);
        const q_dot_next = new Array(n).fill(0);

        for (let i = 0; i < n; i++) {
            q_next[i] = q_pred[i] + (dt * dt * this.beta) * q_ddot_next[i];
            q_dot_next[i] = q_dot_pred[i] + (dt * this.gamma) * q_ddot_next[i];
        }

        // Update State
        body.q = q_next;
        body.q_dot = q_dot_next;
        body.q_ddot = q_ddot_next;
    }
}
