interface StatusBannerProps {
  message: string | null;
}

export default function StatusBanner({ message }: StatusBannerProps) {
  if (!message) return null;
  return (
    <p className="mb-4 inline-flex items-center rounded-full bg-[#efe4d6] px-3 py-1 text-sm font-medium text-[#101419]">
      {message}
    </p>
  );
}
