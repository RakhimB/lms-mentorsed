import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  href?: string;
};

export const Logo = ({ href = "/" }: LogoProps) => {
  return (
    <Link href={href} className="flex items-center">
      <Image
        src="/logo.svg"
        alt="MentorsED Logo"
        width={120}
        height={30}
        className="h-7 w-auto"
        priority
      />
    </Link>
  );
};