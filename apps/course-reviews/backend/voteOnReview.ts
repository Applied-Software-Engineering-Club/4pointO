"use server";

import { createClient } from "@/utils/supabase/server";
import { isReviewId, isSjsuEmail, type VoteDirection } from "./review";

export type { VoteDirection } from "./review";

function reviewId(id: string) {
  const trimmed = id.trim();
  if (!isReviewId(trimmed)) {
    throw new Error("Could not vote on this review.");
  }

  return trimmed;
}

function direction(value: string): VoteDirection {
  if (value !== "up" && value !== "down") {
    throw new Error("Choose an upvote or downvote.");
  }

  return value;
}

async function signedInSjsuUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !isSjsuEmail(auth.user.email)) {
    throw new Error("An authenticated SJSU email is required to vote.");
  }

  return { supabase, user: auth.user };
}

export async function voteOnReview(id: string, value: VoteDirection) {
  const reviewIdValue = reviewId(id);
  const voteDirection = direction(value);
  const { supabase, user } = await signedInSjsuUser();

  const { data, error } = await supabase
    .from("review_votes")
    .upsert(
      {
        review_id: reviewIdValue,
        user_id: user.id,
        direction: voteDirection,
      },
      { onConflict: "review_id,user_id" },
    )
    .select("review_id, direction")
    .single();

  if (error?.message.includes("cannot vote on your own review")) {
    throw new Error("You cannot vote on your own review.");
  }

  if (error || !data || data.review_id !== reviewIdValue) {
    throw new Error("Could not save your vote.");
  }

  return {
    reviewId: data.review_id,
    direction: data.direction as VoteDirection,
  };
}

export async function removeReviewVote(id: string): Promise<void> {
  const reviewIdValue = reviewId(id);
  const { supabase, user } = await signedInSjsuUser();
  const { error } = await supabase
    .from("review_votes")
    .delete()
    .eq("review_id", reviewIdValue)
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Could not remove your vote.");
  }
}

export async function getMyReviewVote(id: string): Promise<VoteDirection | null> {
  const reviewIdValue = reviewId(id);
  const { supabase, user } = await signedInSjsuUser();
  const { data, error } = await supabase
    .from("review_votes")
    .select("direction")
    .eq("review_id", reviewIdValue)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load your vote.");
  }

  return data?.direction === "up" || data?.direction === "down" ? data.direction : null;
}
