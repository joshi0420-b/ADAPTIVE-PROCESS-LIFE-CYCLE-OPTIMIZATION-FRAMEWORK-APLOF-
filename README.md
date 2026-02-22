# ADAPTIVE-PROCESS-LIFE-CYCLE-OPTIMIZATION-FRAMEWORK-APLOF-

## Introduction <br>

The CPU Scheduling Algorithm Visualizer is a web-based tool that allows users to interactively visualize various CPU scheduling algorithms. This project aims to provide an educational resource for understanding how different scheduling algorithms work internally and their effects on the execution of processes in a CPU. <br>

## Features <br>
- Interactive visualization of CPU scheduling algorithms
- Support for the following algorithms 👇
- First Come First Serve (FCFS)
- Shortest Job First (SJF)
- Round Robin Scheduling (RRS)
- Priority CPU Scheduling
- Shortest Remaining Time First (SRTF)
- User-friendly interface for adjusting algorithm parameters
- Clear visualization of process execution, arrival times, waiting times, and more
<br>

## Algorithms Implemented
- First Come First Serve (FCFS)
- Shortest Job First (SJF)
- Round Robin Scheduling (RRS)
- Priority CPU Scheduling
- Shortest Remaining Time First (SRTF)

<br>

## Tech Stack
- HTML
- CSS
- JavaScript


## Implementation 👇


### FCFS (First Come First Serve):  <br>
FCFS Algorithm. is a non-preemptive algorithm and it execute processes according to its arrival time(process that comes first in the ready queue). FCFS also suffers from starvation which arise if the first process has larger burst time. <br>


### SJF (Shortest Job First):   <br>
SJF Algorithm. is a non-preemptive algorithm in which the process having shortest /smallest burst time is executed first. It significantly reduces the average waiting time for other processes awaiting execution. <br>


### RRS (Round Robin Algorithm):  <br>
Round robin is a pre-emptive algorithm. The process that is preempted is added to the end of the queue. This algorithm also offers starvation free execution of processes.  <br>


### Priority CPU Scheduling:  <br>
It is a non-preemptive algorithm. In this algo if the new process arrived at the ready queue has a higher priority than the currently running process, the CPU is preempted, which means the processing of the current process is stoped and the incoming new process with higher priority gets the CPU for its execution.  <br>


### SRTF (Shortest Remaining Time First):  <br>
SRTF is a pre-emptive algorithm. At the arrival of every process, the short term scheduler schedules the process with the least remaining burst time among the list of available processes and the running process. Processes which have long burst time will have to wait for long time for execution  <br>

## Usage

    Open the visualizer in your web browser.
    Select an algorithm from the dropdown menu.
    Add processes with their arrival times, burst times, and priorities.
    Click "Run" to visualize the algorithm's execution.

