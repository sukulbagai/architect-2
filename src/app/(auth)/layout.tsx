export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
