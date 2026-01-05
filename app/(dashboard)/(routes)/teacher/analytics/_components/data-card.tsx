import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";

interface DataCardProps {
  value: number;
  label: string;
  shouldFormat?: boolean;
}

export const DataCard = ({ value, label, shouldFormat }: DataCardProps) => {
  return (
    <Card className="rounded-md border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {label}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold tracking-tight">
          {shouldFormat ? formatPrice(value) : value}
        </div>
      </CardContent>
    </Card>
  );
};
