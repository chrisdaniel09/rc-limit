import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/components/ui/toast';
import { formatPhone } from '@/lib/format';

// §10.1 Login: brand panel on the left from lg, form on the right; single column on mobile.
export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { brand } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  if (isAuthenticated) return <Navigate to={from ?? '/'} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, "You weren't signed in. Check your email and password."));
    } finally {
      setLoading(false);
    }
  };

  const logo = brand.logo && !logoBroken
    ? <img src={brand.logo} alt={brand.name} onError={() => setLogoBroken(true)} className="h-10 max-w-[220px] object-contain" />
    : <span className="text-2xl font-semibold">{brand.name}</span>;

  return (
    <div className="flex min-h-dvh bg-background">
      <aside
        className="relative hidden w-[45%] flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex"
        style={brand.loginBackground ? { backgroundImage: `url("${brand.loginBackground}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div>{logo}</div>
        <div className="max-w-md">
          <p className="text-title text-sidebar-foreground">{brand.name}</p>
          <p className="mt-2 text-sm text-sidebar-foreground/80">Leads, loans, sub-limits and RC tracking in one place.</p>
        </div>
        {(brand.supportEmail || brand.supportPhone) && (
          <div className="space-y-1 text-sm text-sidebar-foreground/80">
            <p className="font-medium text-sidebar-foreground">Need help?</p>
            {brand.supportEmail && <a href={`mailto:${brand.supportEmail}`} className="flex items-center gap-2 hover:underline"><Mail aria-hidden className="size-4" />{brand.supportEmail}</a>}
            {brand.supportPhone && <a href={`tel:${brand.supportPhone}`} className="num flex items-center gap-2 hover:underline"><Phone aria-hidden className="size-4" />{formatPhone(brand.supportPhone)}</a>}
          </div>
        )}
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">{logo}</div>
          <h1 className="text-title text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the email your admin set up for you.</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {from && from !== '/' && !error && <Alert tone="info">Your session ended. Sign in again to continue.</Alert>}
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Field label="Email" required>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loading} loadingText="Signing in…">Sign in</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
