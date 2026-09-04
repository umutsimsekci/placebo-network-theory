/* CET-N 1.0.0 — literal JavaScript port of model/network.py. No fitted biological parameters. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CET = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const DEFAULTS = {
  "schema_version": "1.0.0",
  "nodes": [
    "command",
    "opioid",
    "threat",
    "autonomic",
    "endocrine",
    "cardiovascular",
    "immune"
  ],
  "time_constants": [
    1,
    2,
    1.5,
    3,
    8,
    5,
    20
  ],
  "capacities": [
    1,
    1,
    1,
    1,
    1,
    1,
    1
  ],
  "prior_weight": 0.6,
  "coupling": 1,
  "opioid_gate": 1,
  "nocebo_gate": 1,
  "autonomic_gate": 1,
  "endocrine_gate": 1,
  "expectancy_direct": 0.3,
  "conditioning_direct": 0.2,
  "conditioning_bypass": 0.2,
  "belief_learning": 0.6,
  "inference_to_command": 0.35,
  "sensory_disease_gain": 0.25,
  "disease_decay": 0.02,
  "learning_rate": 0.25,
  "ui_bounds": {
    "coupling": [
      0,
      1.5
    ],
    "prior_weight": [
      0,
      1
    ],
    "gates": [
      0,
      1
    ],
    "expectation": [
      -1,
      1
    ],
    "association": [
      -1,
      1
    ],
    "drug": [
      0,
      1
    ]
  },
  "interpretation": "Illustrative dimensionless values; no biological calibration, clinical prediction, or treatment optimization. Positive symptom change is worse. Cardiovascular and immune states are deviations of endpoint-specific latent axes, not universal health scores."
};
  const NODES = DEFAULTS.nodes.slice();
  const copy = x => JSON.parse(JSON.stringify(x));
  const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
  const mv = (A,x) => A.map(r=>dot(r,x));
  const zero = () => Array(7).fill(0);
  function inputs(o={}) {
    const v={expectation:0,association:0,drug:0,sensory:0,disease:0,...o};
    for(const k of Object.keys(v)) if(!Number.isFinite(v[k])) throw Error('Non-finite input: '+k);
    return v;
  }
  function matrices(p) {
    const W=Array.from({length:7},zero);
    W[1][0]=-.55; W[2][0]=.45;
    W[3][0]=.25; W[3][4]=.15;
    W[4][0]=.20; W[4][3]=.15;
    W[5][3]=.50*p.autonomic_gate; W[5][4]=.10*p.endocrine_gate;
    W[6][3]=.30*p.autonomic_gate; W[6][4]=.20*p.endocrine_gate;
    for(let i=0;i<7;i++) for(let j=0;j<7;j++) W[i][j]*=p.coupling;
    const H=[0,-.45*p.opioid_gate,.25*p.nocebo_gate,0,0,.10,.10].map(v=>v*p.coupling);
    const bz=zero(); bz[0]=p.inference_to_command;
    const K=W.map((row,i)=>row.map((v,j)=>v+bz[i]*(1-p.prior_weight)*H[j]));
    return {W,H,bz,K};
  }
  function contractionBound(p) {return Math.max(...matrices(p).K.map(r=>r.reduce((s,v)=>s+Math.abs(v),0)));}
  function configuration(o={}) {
    const p={...copy(DEFAULTS),...copy(o)};
    for(const [k,lo,hi] of [['coupling',0,1.5],['prior_weight',0,1],['opioid_gate',0,1],['nocebo_gate',0,1],['autonomic_gate',0,1],['endocrine_gate',0,1]]) {
      if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi) throw Error('Out of range: '+k);
    }
    for(const k of ['time_constants','capacities']) {
      if(!Array.isArray(p[k])||p[k].length!==7||p[k].some(v=>!Number.isFinite(v)||v<=0)) throw Error('Invalid '+k);
    }
    for(const k of ['expectancy_direct','conditioning_direct','conditioning_bypass','belief_learning','inference_to_command','sensory_disease_gain','disease_decay','learning_rate'])
      if(!Number.isFinite(p[k])) throw Error('Invalid '+k);
    if(p.disease_decay<=0||p.sensory_disease_gain<0) throw Error('Invalid disease settings');
    if(contractionBound(p)>=1) throw Error('Contraction constraint violated');
    return p;
  }
  function belief(p,i) {return i.expectation+p.belief_learning*i.association;}
  function observations(x,p,i) {
    const sensory=i.sensory+dot(x,matrices(p).H)+p.sensory_disease_gain*i.disease;
    const z=p.prior_weight*belief(p,i)+(1-p.prior_weight)*sensory;
    return [z,x[3],x[4],x[5],x[6],i.disease];
  }
  function externalDrive(p,i) {
    const q=zero();
    const z=p.prior_weight*belief(p,i)+(1-p.prior_weight)*(i.sensory+p.sensory_disease_gain*i.disease);
    q[0]=p.expectancy_direct*i.expectation+p.conditioning_direct*i.association+p.inference_to_command*z;
    q[3]=p.conditioning_bypass*i.association;
    q[5]=.15*i.drug; q[6]=-.15*i.drug;
    return q;
  }
  function transduce(v,p) {return v.map((z,j)=>p.capacities[j]*Math.tanh(((j===1||j===2)?Math.max(z,0):z)/p.capacities[j]));}
  function rhs(x,p,i) {
    const {K}=matrices(p),q=externalDrive(p,i),v=transduce(mv(K,x).map((a,j)=>a+q[j]),p);
    return x.map((a,j)=>(-a+v[j])/p.time_constants[j]);
  }
  function rk4Step(x,dt,p,i) {
    const k1=rhs(x,p,i),k2=rhs(x.map((v,j)=>v+dt*k1[j]/2),p,i),
      k3=rhs(x.map((v,j)=>v+dt*k2[j]/2),p,i),k4=rhs(x.map((v,j)=>v+dt*k3[j]),p,i);
    return x.map((v,j)=>v+dt*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6);
  }
  function equilibrium(p,i=inputs(),tol=1e-13,maxiter=10000) {
    const {K}=matrices(p),q=externalDrive(p,i); let x=zero();
    for(let n=0;n<maxiter;n++) {
      const xn=transduce(mv(K,x).map((v,j)=>v+q[j]),p);
      if(Math.max(...xn.map((v,j)=>Math.abs(v-x[j])))<tol)return xn;
      x=xn;
    }
    throw Error('Fixed point did not converge');
  }
  function simulate(p,inputFn,duration=100,dt=.05,x0=null) {
    const n=Math.round(duration/dt);
    if(dt<=0||duration<=0||Math.abs(n*dt-duration)>1e-9)throw Error('Invalid time grid');
    const time=[0],states=[x0?x0.slice():zero()],out=[observations(states[0],p,inputFn(0))];
    for(let j=0;j<n;j++) {
      time.push((j+1)*dt);
      states.push(rk4Step(states[j],dt,p,inputFn(j*dt+dt/2)));
      out.push(observations(states[j+1],p,inputFn(time[j+1])));
    }
    return {time,states,out};
  }
  function diseaseTrajectory(t,initial=.6,forcing=0,decay=.02) {
    if(initial<0||forcing<0||decay<=0)throw Error('Invalid disease process');
    return initial*Math.exp(-decay*t)+forcing/decay*(1-Math.exp(-decay*t));
  }
  function learnAssociations(cues,outcomes,alpha=.25,forgetting=0,nCues=null) {
    if(alpha<0||alpha>1||forgetting<0||forgetting>1||cues.length!==outcomes.length)throw Error('Invalid learning inputs');
    const values=Array(nCues||Math.max(...cues)+1).fill(0),prior=[],posterior=[];
    for(let j=0;j<cues.length;j++) {
      const c=cues[j]; if(!Number.isInteger(c)||c<0||c>=values.length||!Number.isFinite(outcomes[j]))throw Error('Invalid cue/outcome');
      prior.push(values[c]); for(let k=0;k<values.length;k++)values[k]*=1-forgetting;
      values[c]+=alpha*(outcomes[j]-values[c]);posterior.push(values[c]);
    }
    return {prior,posterior,values};
  }
  function learnOne(value,outcome,alpha=.25) {
    if(![value,outcome,alpha].every(Number.isFinite)||alpha<0||alpha>1)throw Error('Invalid learning update');
    return value+alpha*(outcome-value);
  }
  return {DEFAULTS,NODES,configuration,inputs,matrices,contractionBound,belief,observations,externalDrive,transduce,rhs,rk4Step,equilibrium,simulate,diseaseTrajectory,learnAssociations,learnOne};
});

