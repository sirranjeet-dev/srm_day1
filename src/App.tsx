/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from './firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  GraduationCap, 
  Heart, 
  Send, 
  ClipboardCheck, 
  LogOut, 
  LogIn, 
  Sparkles,
  ChevronRight,
  BookOpen,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Assessment {
  score: number;
  feedback: string;
  assessedAt: any;
  status: 'pending' | 'completed';
}

interface Assignment {
  id: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  content: string;
  submittedAt: any;
  assessment?: Assessment;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assessingId, setAssessingId] = useState<string | null>(null);

  // Form states
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAssignments([]);
      return;
    }

    const q = query(collection(db, 'assignments'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      setAssignments(data);
    }, (error) => {
      console.error("Firestore Error:", error);
      toast.error("Failed to load assignments. Check permissions.");
    });

    return () => unsubscribe();
  }, [user]);

  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
        toast.error("Firebase connection failed. Check console.");
      }
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Welcome back, Educator.");
    } catch (error) {
      console.error(error);
      toast.error("Login failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEmail || !assignmentTitle || !content) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        studentName,
        studentEmail,
        assignmentTitle,
        content,
        submittedAt: serverTimestamp(),
        assessment: {
          status: 'pending',
          score: 0,
          feedback: '',
          assessedAt: null
        }
      });
      toast.success("Assignment submitted with grace.");
      setStudentName('');
      setStudentEmail('');
      setAssignmentTitle('');
      setContent('');
    } catch (error) {
      console.error(error);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const assessAssignment = async (assignment: Assignment) => {
    setAssessingId(assignment.id);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Assess this student assignment titled "${assignment.assignmentTitle}" by ${assignment.studentName}.
        Content: ${assignment.content}
        
        Provide a score out of 100 and constructive feedback.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              feedback: { type: Type.STRING }
            },
            required: ["score", "feedback"]
          }
        }
      });

      const result = JSON.parse(response.text);
      
      await updateDoc(doc(db, 'assignments', assignment.id), {
        assessment: {
          score: result.score,
          feedback: result.feedback,
          assessedAt: serverTimestamp(),
          status: 'completed'
        }
      });
      toast.success(`Assessment complete for ${assignment.studentName}`);
    } catch (error) {
      console.error(error);
      toast.error("AI Assessment failed.");
    } finally {
      setAssessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wedding-cream">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-wedding-gold"
        >
          <Heart size={48} fill="currentColor" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wedding-cream selection:bg-wedding-gold/30">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="border-b border-wedding-gold/20 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-wedding-gold/10 rounded-full">
              <GraduationCap className="text-wedding-gold" size={24} />
            </div>
            <h1 className="text-2xl font-serif tracking-tight text-wedding-ink">
              The Academic <span className="italic text-wedding-gold">Union</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-medium uppercase tracking-widest text-wedding-gold">Educator</span>
                  <span className="text-sm text-wedding-ink">{user.displayName}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:bg-wedding-gold/10">
                  <LogOut size={20} className="text-wedding-sage" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={handleLogin} className="font-serif uppercase tracking-widest text-wedding-gold hover:bg-wedding-gold/10">
                Educator Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <Tabs defaultValue="submit" className="w-full">
          <div className="flex justify-center mb-12">
            <TabsList className="bg-white border border-wedding-gold/20 p-1 rounded-none h-auto">
              <TabsTrigger value="submit" className="rounded-none data-[state=active]:bg-wedding-gold data-[state=active]:text-white px-8 py-2 font-serif uppercase tracking-widest">
                Submission Portal
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="rounded-none data-[state=active]:bg-wedding-gold data-[state=active]:text-white px-8 py-2 font-serif uppercase tracking-widest">
                Assessment Hall
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="submit" className="mt-0">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-5xl font-serif leading-tight">
                    A Celebration of <br />
                    <span className="italic text-wedding-gold">Knowledge</span>
                  </h2>
                  <p className="text-wedding-sage text-lg leading-relaxed max-w-md">
                    We invite you to share your academic journey. Every assignment is a testament to your growth and dedication.
                  </p>
                </div>
                
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img 
                    src="https://picsum.photos/seed/library/800/1000" 
                    alt="Library" 
                    className="object-cover w-full h-full grayscale hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 border-[12px] border-white/20 m-6"></div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="wedding-card"
              >
                <div className="text-center mb-8">
                  <Heart className="mx-auto text-wedding-gold mb-4" size={32} />
                  <h3 className="text-2xl font-serif uppercase tracking-widest">Submit Your Work</h3>
                  <div className="w-12 h-px bg-wedding-gold/30 mx-auto mt-4"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-wedding-gold font-medium">Full Name</label>
                      <input 
                        className="wedding-input w-full" 
                        placeholder="e.g. Julianne Moore"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-wedding-gold font-medium">Email Address</label>
                      <input 
                        className="wedding-input w-full" 
                        type="email"
                        placeholder="e.g. julianne@university.edu"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-wedding-gold font-medium">Assignment Title</label>
                    <input 
                      className="wedding-input w-full" 
                      placeholder="e.g. The Renaissance of Modern Ethics"
                      value={assignmentTitle}
                      onChange={(e) => setAssignmentTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-wedding-gold font-medium">Your Thesis / Content</label>
                    <textarea 
                      className="wedding-input w-full min-h-[200px] resize-none" 
                      placeholder="Share your thoughts..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="wedding-button w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : (
                      <>
                        <Send size={18} />
                        Present Assignment
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            {!user ? (
              <div className="text-center py-24 wedding-card max-w-2xl mx-auto">
                <LogIn className="mx-auto text-wedding-gold mb-6" size={48} />
                <h3 className="text-3xl font-serif mb-4">Educator Access Only</h3>
                <p className="text-wedding-sage mb-8">Please sign in to view and assess student submissions.</p>
                <Button onClick={handleLogin} className="wedding-button">
                  Sign In with Google
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-serif">Assessment Hall</h2>
                    <p className="text-wedding-sage">Reviewing {assignments.length} submissions from our scholars.</p>
                  </div>
                  <Badge variant="outline" className="border-wedding-gold text-wedding-gold rounded-none px-4 py-1 uppercase tracking-widest text-[10px]">
                    Live Updates
                  </Badge>
                </div>

                <div className="grid gap-6">
                  <AnimatePresence mode="popLayout">
                    {assignments.map((assignment) => (
                      <motion.div
                        key={assignment.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="wedding-card p-0 overflow-hidden"
                      >
                        <div className="grid md:grid-cols-[1fr_300px]">
                          <div className="p-8 space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-2xl font-serif text-wedding-gold">{assignment.assignmentTitle}</h4>
                                <div className="flex items-center gap-2 text-wedding-sage text-sm mt-1">
                                  <UserIcon size={14} />
                                  <span>{assignment.studentName}</span>
                                  <Separator orientation="vertical" className="h-3 bg-wedding-gold/20" />
                                  <span>{assignment.studentEmail}</span>
                                </div>
                              </div>
                              {assignment.assessment?.status === 'completed' ? (
                                <div className="text-right">
                                  <div className="text-4xl font-display text-wedding-gold">{assignment.assessment.score}</div>
                                  <div className="text-[10px] uppercase tracking-widest text-wedding-sage font-bold">Grade</div>
                                </div>
                              ) : (
                                <Badge className="bg-wedding-sage/10 text-wedding-sage hover:bg-wedding-sage/20 border-none rounded-none uppercase tracking-tighter text-[10px]">
                                  Pending Review
                                </Badge>
                              )}
                            </div>
                            
                            <Separator className="bg-wedding-gold/10" />
                            
                            <ScrollArea className="h-32">
                              <p className="text-wedding-ink/80 leading-relaxed italic">
                                "{assignment.content}"
                              </p>
                            </ScrollArea>

                            {assignment.assessment?.status === 'completed' && (
                              <div className="bg-wedding-cream/50 p-4 border-l-2 border-wedding-gold">
                                <div className="flex items-center gap-2 text-wedding-gold mb-2">
                                  <Sparkles size={14} />
                                  <span className="text-[10px] uppercase tracking-widest font-bold">AI Assessment</span>
                                </div>
                                <p className="text-sm text-wedding-sage italic">
                                  {assignment.assessment.feedback}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="bg-wedding-cream/30 p-8 border-l border-wedding-gold/10 flex flex-col justify-center items-center text-center space-y-4">
                            {assignment.assessment?.status === 'completed' ? (
                              <>
                                <ClipboardCheck className="text-wedding-sage" size={32} />
                                <p className="text-xs uppercase tracking-widest text-wedding-sage font-medium">Assessed on {new Date(assignment.assessment.assessedAt?.seconds * 1000).toLocaleDateString()}</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-wedding-gold/30 text-wedding-gold hover:bg-wedding-gold/10 rounded-none w-full"
                                  onClick={() => assessAssignment(assignment)}
                                  disabled={assessingId === assignment.id}
                                >
                                  {assessingId === assignment.id ? "Re-evaluating..." : "Re-evaluate"}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Sparkles className="text-wedding-gold animate-pulse" size={32} />
                                <p className="text-xs uppercase tracking-widest text-wedding-gold font-medium">Awaiting AI Insight</p>
                                <Button 
                                  className="wedding-button w-full"
                                  onClick={() => assessAssignment(assignment)}
                                  disabled={assessingId === assignment.id}
                                >
                                  {assessingId === assignment.id ? "Analyzing..." : "Assess Now"}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {assignments.length === 0 && (
                    <div className="text-center py-24 wedding-card">
                      <BookOpen className="mx-auto text-wedding-gold/30 mb-4" size={48} />
                      <p className="text-wedding-sage font-serif text-xl italic">The hall is quiet. No submissions yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-wedding-gold/20 py-12 mt-24">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
          <div className="flex justify-center items-center gap-4 text-wedding-gold/30">
            <Separator className="w-12 bg-wedding-gold/20" />
            <Heart size={16} />
            <Separator className="w-12 bg-wedding-gold/20" />
          </div>
          <p className="font-serif text-wedding-sage italic">Dedicated to the pursuit of excellence and the union of minds.</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-wedding-gold/50">© 2026 The Academic Union • Established in Wisdom</p>
        </div>
      </footer>
    </div>
  );
}
