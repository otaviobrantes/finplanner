
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { Asset, Transaction } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface ProjectionsProps {
  data: { year: number; value: number; invested: number }[];
}

export const PatrimonyChart: React.FC<ProjectionsProps> = ({ data }) => {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} />
          <Legend />
          <Area type="monotone" dataKey="value" stroke="#00C49F" fillOpacity={1} fill="url(#colorValue)" name="Patrimônio Total" />
          <Area type="monotone" dataKey="invested" stroke="#8884d8" fillOpacity={1} fill="url(#colorInvested)" name="Total Aportado" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ScenarioProps {
  data: { year: number; pessimistic: number; realistic: number; optimistic: number }[];
}

export const ScenarioChart: React.FC<ScenarioProps> = ({ data }) => {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} />
          <Legend />
          <Line type="monotone" dataKey="pessimista" stroke="#FF8042" strokeWidth={2} name="Cenário Pessimista (4%)" dot={false} />
          <Line type="monotone" dataKey="realista" stroke="#00C49F" strokeWidth={3} name="Cenário Realista (6%)" dot={false} />
          <Line type="monotone" dataKey="otimista" stroke="#0088FE" strokeWidth={2} name="Cenário Otimista (10%)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface AllocationProps {
  assets: Asset[];
}

export const AllocationChart: React.FC<AllocationProps> = ({ assets }) => {
  const data = assets.reduce((acc: any[], asset) => {
    const existing = acc.find(a => a.name === asset.type);
    if (existing) {
      existing.value += asset.totalValue;
    } else {
      acc.push({ name: asset.type, value: asset.totalValue });
    }
    return acc;
  }, []);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ExpensesProps {
  transactions: Transaction[];
}

export const ExpensesBarChart: React.FC<ExpensesProps> = ({ transactions }) => {
  const expenseData = transactions
    .filter(t => t.amount < 0)
    .reduce((acc: any[], t) => {
      const existing = acc.find(i => i.name === t.type);
      if (existing) {
        existing.value += Math.abs(t.amount);
      } else {
        acc.push({ name: t.type, value: Math.abs(t.amount) });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={expenseData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
          <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
             {expenseData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
