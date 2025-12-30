import React from "react"
import { ShieldCheck, Zap, Heart } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="container py-16 max-w-5xl">
      {/* Hero Section */}
      <div className="text-center mb-20">
         <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 text-foreground">
           О проекте <span className="text-primary">Атмосфера2Н</span>
         </h1>
         <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
           Независимое городское издание о людях, фактах и смыслах. Мы создаем медиа нового формата для тех, кто живет городом.
         </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 mb-24 items-start">
        <div className="space-y-6 text-lg leading-[1.8] text-foreground/90">
          <p>
            <strong className="text-foreground">Атмосфера2Н</strong> — это независимая платформа, свободная от ангажированности и информационного шума. Мы верим, что качественная журналистика должна быть полезной, проверенной и уважительной к читателю.
          </p>
          <p>
            Наши темы — это то, что действительно волнует горожан: от урбанистики и развития транспортной сети до культурных феноменов и социальных инициатив. Мы не просто фиксируем события, но и анализируем их причины и последствия, помогая вам лучше понимать город, в котором вы живете.
          </p>
        </div>
        
        <div className="relative bg-secondary/30 p-10 rounded-2xl border border-border/60">
           <div className="absolute -top-4 -left-4 w-12 h-12 bg-accent rounded-full opacity-20" />
           <h3 className="font-bold text-xl mb-6 uppercase tracking-widest text-accent flex items-center gap-2">
              Наша миссия
           </h3>
           <p className="italic text-2xl font-serif text-foreground leading-relaxed mb-6">
             «Формировать осознанное городское сообщество, предоставляя факты без эмоциональных манипуляций».
           </p>
        </div>
      </div>

      {/* Principles */}
      <div>
        <h2 className="text-3xl font-bold text-center mb-12">Принципы работы</h2>
        <div className="grid md:grid-cols-3 gap-8">
           <div className="p-8 bg-card rounded-xl border border-border/60 hover:border-accent/50 hover:shadow-lg transition-all duration-300 group">
              <div className="w-14 h-14 bg-primary/5 group-hover:bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary transition-colors">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-4 text-foreground">Проверка фактов</h3>
              <p className="text-muted-foreground leading-relaxed">
                Мы дорожим репутацией. Каждая новость и цифра проходят тщательную верификацию перед публикацией. Никаких слухов.
              </p>
           </div>
           
           <div className="p-8 bg-card rounded-xl border border-border/60 hover:border-accent/50 hover:shadow-lg transition-all duration-300 group">
              <div className="w-14 h-14 bg-primary/5 group-hover:bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary transition-colors">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-4 text-foreground">Без инфошума</h3>
              <p className="text-muted-foreground leading-relaxed">
                Мы ценим ваше время. Наши материалы очищены от воды, кликбейта и навязчивых рекламных форматов. Только суть.
              </p>
           </div>
           
           <div className="p-8 bg-card rounded-xl border border-border/60 hover:border-accent/50 hover:shadow-lg transition-all duration-300 group">
              <div className="w-14 h-14 bg-primary/5 group-hover:bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary transition-colors">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-4 text-foreground">Уважение</h3>
              <p className="text-muted-foreground leading-relaxed">
                Мы ведем честный диалог с аудиторией. Тон наших публикаций всегда спокойный, взвешенный и объективный.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}