import talking from "@/assets/teachers/apollo-talking.png.asset.json";
import reading from "@/assets/teachers/apollo-reading.png.asset.json";
import happy from "@/assets/teachers/apollo-happy.png.asset.json";
import thinking from "@/assets/teachers/apollo-thinking.png.asset.json";
import listening from "@/assets/teachers/apollo-listening.png.asset.json";
import caring from "@/assets/teachers/apollo-caring.png.asset.json";
import wink from "@/assets/teachers/apollo-nudge.png.asset.json";
import cheer from "@/assets/teachers/apollo-cheer.png.asset.json";

/** Apollo is the only teacher. Each pose is a facial reaction he can show. */
export const TEACHER_NAME = "Apollo";
export const APOLLO_POSES = {
  talking: talking.url,
  reading: reading.url,
  happy: happy.url,
  thinking: thinking.url,
  listening: listening.url,
  caring: caring.url,
  nudge: wink.url,
  cheer: cheer.url,
} as const;
export type ApolloMood = keyof typeof APOLLO_POSES;
