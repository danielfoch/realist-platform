import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Play, 
  Pause, 
  Send, 
  Headphones, 
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Volume2,
  SkipBack,
  SkipForward
} from "lucide-react";
import { format } from "date-fns";

interface PodcastEpisode {
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: string;
  link: string;
  imageUrl?: string;
}

const questionSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  question: z.string().min(10, "Please provide more detail for your question"),
});

type QuestionFormValues = z.infer<typeof questionSchema>;

export default function Podcast() {
  const { toast } = useToast();
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      name: "",
      email: "",
      question: "",
    },
  });

  const { data: episodes, isLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ["/api/podcast/episodes"],
  });

  const questionMutation = useMutation({
    mutationFn: async (data: QuestionFormValues) => {
      return apiRequest("POST", "/api/podcast/question", data);
    },
    onSuccess: () => {
      toast({
        title: "Question Submitted!",
        description: "We'll review your question for an upcoming episode.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit question. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitQuestion = (data: QuestionFormValues) => {
    questionMutation.mutate(data);
  };

  const playEpisode = (episode: PodcastEpisode) => {
    if (currentEpisode?.audioUrl === episode.audioUrl && audioRef) {
      if (isPlaying) {
        audioRef.pause();
        setIsPlaying(false);
      } else {
        audioRef.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(episode.audioUrl);
      audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.play();
      setAudioRef(audio);
      setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef) {
      audioRef.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBack = () => {
    if (audioRef) {
      audioRef.currentTime = Math.max(0, audioRef.currentTime - 15);
    }
  };

  const skipForward = () => {
    if (audioRef) {
      audioRef.currentTime = Math.min(duration, audioRef.currentTime + 30);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="The Canadian Real Estate Investor Podcast | Realist.ca"
        description="Listen to Canada's #1 real estate podcast for expert insights on Canadian real estate investing, market analysis, and investment strategies with Daniel and Nick."
        canonicalUrl="https://realist.ca/podcast"
      />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Headphones className="w-4 h-4" />
            <span className="text-sm font-medium">The Canadian Real Estate Investor Podcast</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Canada's #1 Real Estate Podcast
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Expert analysis, market trends, and actionable strategies for Canadian real estate investors.
          </p>
        </div>

        <Card className="mb-12">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Submit a Question for the Show</h2>
                <p className="text-sm text-muted-foreground">
                  Have a question for Daniel and Nick? Submit it for the Q&A segment!
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmitQuestion)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} data-testid="input-question-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-question-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="question"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Question</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What would you like to know about real estate investing?"
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-question-text"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={questionMutation.isPending}
                  data-testid="button-submit-question"
                >
                  {questionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Question
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {currentEpisode && (
          <Card className="mb-8 sticky top-4 z-50 border-primary/20 bg-card/95 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={skipBack}
                    data-testid="button-skip-back"
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => playEpisode(currentEpisode)}
                    data-testid="button-play-pause"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={skipForward}
                    data-testid="button-skip-forward"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{currentEpisode.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 h-1 accent-primary"
                      data-testid="input-seek-bar"
                    />
                    <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
                  </div>
                </div>
                <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-6">Latest Episodes</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : episodes && episodes.length > 0 ? (
            episodes.map((episode, index) => (
              <Card 
                key={index} 
                className={`hover-elevate transition-all ${
                  currentEpisode?.audioUrl === episode.audioUrl ? "border-primary/50" : ""
                }`}
                data-testid={`card-episode-${index}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Button
                      size="icon"
                      variant={currentEpisode?.audioUrl === episode.audioUrl && isPlaying ? "default" : "outline"}
                      onClick={() => playEpisode(episode)}
                      className="flex-shrink-0 mt-1"
                      data-testid={`button-play-episode-${index}`}
                    >
                      {currentEpisode?.audioUrl === episode.audioUrl && isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg leading-tight mb-2">
                        {episode.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {episode.description?.replace(/<[^>]*>/g, "")}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {episode.pubDate ? format(new Date(episode.pubDate), "MMM d, yyyy") : "Unknown date"}
                        </span>
                        {episode.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {episode.duration}
                          </span>
                        )}
                        {episode.link && (
                          <a
                            href={episode.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            data-testid={`link-episode-${index}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Details
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Headphones className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No episodes available yet. Check back soon!</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Listen on your favorite platform</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="outline" asChild>
              <a 
                href="https://podcasts.apple.com" 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid="link-apple-podcasts"
              >
                Apple Podcasts
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href="https://open.spotify.com" 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid="link-spotify"
              >
                Spotify
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href="https://www.youtube.com" 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid="link-youtube"
              >
                YouTube
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
