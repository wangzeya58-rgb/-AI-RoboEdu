import LoginForm from "@/components/auth/LoginForm";
import { isDemoAuthAllowed } from "@/lib/auth/demo-users";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm demoEnabled={isDemoAuthAllowed()} />;
}
