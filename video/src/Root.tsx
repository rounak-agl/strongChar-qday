import { Composition } from "remotion";
import { Film, FPS, TOTAL } from "./Film";

export const Root = () => <Composition id="QDay" component={Film} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />;
