import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronDown,
  Play, Lock, ArrowRight, Users, ExternalLink, Menu, X, LogIn,
  BarChart3, MessageSquare, Rocket
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  videoDuration: string | null;
  sortOrder: number;
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: Lesson[];
}

interface CourseData {
  modules: Module[];
  progress: { completed: number; total: number };
}

interface EnrollmentData {
  enrolled: boolean;
  coachingExpired?: boolean;
  enrolledAt?: string;
  expiresAt?: string | null;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function CourseGate() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-0 shadow-xl" data-testid="course-gate">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Multiplex Masterclass
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This course is available to enrolled students. Purchase the Multiplex Masterclass to get instant access to all lessons.
          </p>
          <Button
            onClick={() => navigate("/masterclass")}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3"
            data-testid="course-gate-cta"
          >
            Learn More & Enroll <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginPrompt() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-0 shadow-xl" data-testid="course-login-prompt">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Sign In Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please log in to access your Multiplex Masterclass course content.
          </p>
          <Button
            onClick={() => navigate("/login?returnUrl=/course")}
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3"
            data-testid="course-login-btn"
          >
            <LogIn className="mr-2 w-4 h-4" /> Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Course() {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  const { data: enrollment, isLoading: enrollmentLoading, error: enrollmentError } = useQuery<EnrollmentData>({
    queryKey: ["/api/course/enrollment"],
    retry: false,
  });

  const { data: courseData, isLoading: courseLoading } = useQuery<CourseData>({
    queryKey: ["/api/course/modules"],
    enabled: enrollment?.enrolled === true,
  });

  const toggleProgress = useMutation({
    mutationFn: async (lessonId: string) => {
      const res = await apiRequest("POST", `/api/course/progress/${lessonId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/course/modules"] });
    },
    onError: () => {
      toast({ title: "Failed to update progress", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (courseData?.modules && !selectedLessonId) {
      const firstIncomplete = courseData.modules
        .flatMap(m => m.lessons)
        .find(l => !l.completed);
      const firstLesson = courseData.modules[0]?.lessons[0];
      const target = firstIncomplete || firstLesson;
      if (target) {
        setSelectedLessonId(target.id);
        setExpandedModules(new Set([target.moduleId]));
      }
    }
  }, [courseData, selectedLessonId]);

  if (enrollmentLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  if (enrollmentError) {
    return <LoginPrompt />;
  }

  if (!enrollment?.enrolled) {
    return <CourseGate />;
  }

  if (courseLoading || !courseData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="w-full h-12" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-3" />
          </div>
        </div>
      </div>
    );
  }

  const allLessons = courseData.modules.flatMap(m => m.lessons);
  const selectedLesson = allLessons.find(l => l.id === selectedLessonId);
  const currentIndex = allLessons.findIndex(l => l.id === selectedLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const progressPct = courseData.progress.total > 0
    ? Math.round((courseData.progress.completed / courseData.progress.total) * 100)
    : 0;

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const selectLesson = (lesson: Lesson) => {
    setSelectedLessonId(lesson.id);
    setExpandedModules(prev => new Set([...prev, lesson.moduleId]));
    setSidebarOpen(false);
  };

  const youtubeId = selectedLesson?.videoUrl ? extractYouTubeId(selectedLesson.videoUrl) : null;

  const firstModule = courseData.modules[0];
  const isLastLessonOfModule1 = firstModule &&
    selectedLesson &&
    selectedLesson.moduleId === firstModule.id &&
    firstModule.lessons[firstModule.lessons.length - 1]?.id === selectedLesson.id;

  const module1Complete = firstModule &&
    firstModule.lessons.every(l => l.completed);

  return (
    <>
      <SEO
        title="Multiplex Masterclass - Course"
        description="Access your Multiplex Masterclass course content."
        canonicalUrl="/course"
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                data-testid="sidebar-toggle"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <BookOpen className="w-5 h-5 text-red-500" />
              <h1 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base" data-testid="course-title">
                Multiplex Masterclass
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="hidden md:flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium mr-2"
                data-testid="analyze-deal-header"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Analyze a Deal
              </a>
              <span className="text-xs text-gray-500 hidden sm:inline" data-testid="progress-text">
                {courseData.progress.completed}/{courseData.progress.total} complete
              </span>
              <div className="w-24 sm:w-32">
                <Progress value={progressPct} className="h-2" data-testid="progress-bar" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300" data-testid="progress-pct">
                {progressPct}%
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex">
          <aside
            className={`
              fixed lg:static inset-y-0 left-0 z-40 w-80 bg-white dark:bg-gray-900
              border-r border-gray-200 dark:border-gray-800 overflow-y-auto
              transform transition-transform lg:transform-none
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
              top-0 lg:top-auto pt-16 lg:pt-0
            `}
            data-testid="course-sidebar"
          >
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 lg:hidden z-[-1]"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <div className="p-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
              <a
                href="https://www.skool.com/realist/about"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors text-sm font-medium"
                data-testid="skool-link"
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">Join the Community</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              <a
                href="/"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-sm font-medium"
                data-testid="analyze-deal-sidebar"
              >
                <BarChart3 className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">Analyze Your Deal</span>
                <ArrowRight className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>

            <nav className="p-2" data-testid="module-nav">
              {courseData.modules.map((mod) => {
                const modLessons = mod.lessons;
                const modCompleted = modLessons.filter(l => l.completed).length;
                const isExpanded = expandedModules.has(mod.id);
                const isActive = modLessons.some(l => l.id === selectedLessonId);

                return (
                  <div key={mod.id} className="mb-1" data-testid={`module-${mod.sortOrder}`}>
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                        isActive
                          ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                      data-testid={`module-toggle-${mod.sortOrder}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="font-medium flex-1 truncate">{mod.title}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                        {modCompleted}/{modLessons.length}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {modLessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => selectLesson(lesson)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                              lesson.id === selectedLessonId
                                ? "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 font-medium"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            }`}
                            data-testid={`lesson-nav-${lesson.id}`}
                          >
                            {lesson.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                            )}
                            <span className="truncate flex-1">{lesson.title}</span>
                            {lesson.videoDuration && (
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{lesson.videoDuration}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0 p-4 lg:p-6" data-testid="lesson-content">
            {selectedLesson ? (
              <div className="max-w-4xl">
                {youtubeId ? (
                  <div className="relative w-full bg-black rounded-xl overflow-hidden mb-6" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={selectedLesson.title}
                      data-testid="lesson-video"
                    />
                  </div>
                ) : (
                  <div className="w-full bg-gray-900 rounded-xl flex items-center justify-center mb-6" style={{ paddingBottom: "56.25%", position: "relative" }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Play className="w-16 h-16 mb-3 opacity-30" />
                      <p className="text-sm">Video coming soon</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="lesson-title">
                      {selectedLesson.title}
                    </h2>
                    {selectedLesson.videoDuration && (
                      <span className="text-sm text-gray-500 mt-1 inline-flex items-center gap-1">
                        <Play className="w-3.5 h-3.5" /> {selectedLesson.videoDuration}
                      </span>
                    )}
                  </div>
                  <Button
                    variant={selectedLesson.completed ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleProgress.mutate(selectedLesson.id)}
                    disabled={toggleProgress.isPending}
                    className={selectedLesson.completed ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                    data-testid="mark-complete-btn"
                  >
                    {selectedLesson.completed ? (
                      <><CheckCircle2 className="w-4 h-4 mr-1" /> Completed</>
                    ) : (
                      <><Circle className="w-4 h-4 mr-1" /> Mark Complete</>
                    )}
                  </Button>
                </div>

                {selectedLesson.description && (
                  <div className="prose dark:prose-invert max-w-none mb-8" data-testid="lesson-description">
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {selectedLesson.description}
                    </p>
                  </div>
                )}

                {(isLastLessonOfModule1 || module1Complete) && (
                  <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl p-5 mb-6" data-testid="community-prompt">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-violet-900 dark:text-violet-300 mb-1">
                          Before you move on — join the community
                        </h3>
                        <p className="text-sm text-violet-700 dark:text-violet-400 mb-3">
                          Introduce yourself and tell people what you're trying to build. You'll get better feedback there than anywhere else. 1,300+ investors are already inside.
                        </p>
                        <a
                          href="https://www.skool.com/realist/about"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
                          data-testid="community-prompt-btn"
                        >
                          <Users className="w-4 h-4" /> Join the Community <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/5 dark:to-orange-500/5 mb-6" data-testid="analyze-deal-cta">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">Ready to move on this?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Run the numbers on a real deal with our analyzer</p>
                    </div>
                    <a
                      href="/"
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                      data-testid="analyze-deal-lesson-btn"
                    >
                      Analyze a Deal <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-800">
                  {prevLesson ? (
                    <Button
                      variant="ghost"
                      onClick={() => selectLesson(prevLesson)}
                      className="text-sm"
                      data-testid="prev-lesson-btn"
                    >
                      <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
                      {prevLesson.title}
                    </Button>
                  ) : <div />}
                  {nextLesson ? (
                    <Button
                      variant="ghost"
                      onClick={() => selectLesson(nextLesson)}
                      className="text-sm"
                      data-testid="next-lesson-btn"
                    >
                      {nextLesson.title}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid="course-complete-badge">
                      End of course
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Select a lesson to get started</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
