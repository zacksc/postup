import { cn } from '@/lib/utils'

export interface PostPillProps {
  time: string;
  clientName: string;
  clientColorClass?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function PostPill({ 
  time, 
  clientName, 
  // Cor padrão usando as variáveis do seu tema caso não seja enviada
  clientColorClass = "bg-primary/10 text-primary border-primary/20", 
  onClick 
}: PostPillProps) {
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center w-full max-w-full px-2 py-1 text-[11px] font-medium rounded-md border text-left transition-all",
        "hover:brightness-95 hover:border-primary/50 cursor-pointer",
        clientColorClass
      )}
    >
      <span className="mr-1.5 shrink-0 opacity-70 font-mono text-[10px]">
        {time}
      </span>
      
      <span className="truncate">
        {clientName}
      </span>
    </button>
  )
}