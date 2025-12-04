'use client'

type Props = {}

function Features({}: Props) {
  const features = [
    {
      title: 'AI-Powered Auto-Trading',
      description: 'Trade by typing. Your AI agent executes swaps instantly on Solana — no signatures, no friction.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="7" r="1" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="12" cy="17" r="1" fill="currentColor"/>
        </svg>
      ),
      color: 'text-matrix-teal',
      borderColor: 'border-matrix-teal/30',
      bgGradient: 'from-matrix-teal/10 to-transparent'
    },
    {
      title: 'Real-Time PnL Tracking',
      description: 'See how your bags perform at a glance. Live gains, losses, and token insights updated 24/7.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 10V3H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: 'text-electric-green',
      borderColor: 'border-electric-green/30',
      bgGradient: 'from-electric-green/10 to-transparent'
    },
    {
      title: 'Smart Portfolio Alerts',
      description: 'Get notified when your positions move. Big pumps, dips, or trends — GainzBot keeps you ahead.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8A6 6 0 0 0 6 8C6 11.3137 9 12 9 15V17H15V15C15 12 18 11.3137 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="8" r="1" fill="currentColor"/>
          <circle cx="15" cy="8" r="1" fill="currentColor"/>
        </svg>
      ),
      color: 'text-cyber-yellow',
      borderColor: 'border-cyber-yellow/30',
      bgGradient: 'from-cyber-yellow/10 to-transparent'
    }
  ]

  return (
    <section className="w-full py-20 bg-background px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`bg-background-soft border ${feature.borderColor} rounded-xl p-8 hover:border-opacity-60 transition-all duration-300 group`}
            >
              <div className={`${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                {feature.title}
              </h3>
              <p className="text-foreground/70 leading-relaxed">
                {feature.description}
              </p>
              <div className={`mt-6 h-1 w-0 group-hover:w-full bg-linear-to-r ${feature.bgGradient} transition-all duration-300 rounded-full`}></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features