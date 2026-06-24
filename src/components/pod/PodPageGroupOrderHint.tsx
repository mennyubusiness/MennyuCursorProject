import Link from "next/link";

type PodPageGroupOrderHintProps = {
  groupOrderHref: string;
};

/** Secondary group-order guidance — keeps vendor browsing as the primary focus. */
export function PodPageGroupOrderHint({ groupOrderHref }: PodPageGroupOrderHintProps) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
      Ordering with a group?{" "}
      <Link href={groupOrderHref} className="font-semibold text-brand underline-offset-2 hover:underline">
        Start or join a shared order
      </Link>
      .
    </p>
  );
}
