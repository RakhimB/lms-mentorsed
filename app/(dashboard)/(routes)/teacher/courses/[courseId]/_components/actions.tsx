"use client";

import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useConfettiStore } from "@/hooks/use-confetti-store";


interface ActionsProps {
  disabled: boolean;
  courseId: string;
  isPublished: boolean;
}

export const Actions = ({
  disabled,
  courseId,
  isPublished,
}: ActionsProps) => {
  const router = useRouter();
  const confetti = useConfettiStore();
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
        setIsLoading(true);
        if (isPublished) {
            await axios.patch(`/api/courses/${courseId}/unpublish`);
            toast.success("Course unpublished");
            router.refresh();
        } else {
            await axios.patch(`/api/courses/${courseId}/publish`);
            toast.success("Course published");
            confetti.onOpen();
            router.refresh();}
  } 
    catch {
        toast.error("Something went wrong.");
    }   
    finally {
        setIsLoading(false);
    }
    };
  const onDelete = async () => {
    try {
      setIsLoading(true);
      await axios.delete(`/api/courses/${courseId}`);
      toast.success("Course deleted");
      router.push(`/teacher/courses`);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-x-2">
      <Button disabled={disabled||isLoading} variant="outline" size="sm" onClick={onClick}>
        {isPublished ? "Unpublish Course" : "Publish Course"}
      </Button>

      <ConfirmModal onConfirm={onDelete}>
        <Button size="sm" disabled={isLoading}>
          <Trash className="h-4 w-4" />
        </Button>
      </ConfirmModal>
    </div>
  );
};
