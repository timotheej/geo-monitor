import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Permet de lancer un second serveur dev isolé (tests de bout en bout).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withWorkflow(nextConfig);
