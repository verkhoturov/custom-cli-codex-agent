import type { AppServerClient } from '../../app-server/client.js';
import { type AppServerEvent, decodeAppServerEvent } from '../../app-server/events.js';
import type { TurnCompletedParams } from '../../app-server/protocol.js';
import { interruptTurn, startTurn } from '../../app-server/session.js';
import type { CliState } from '../../types.js';
import type { Terminal } from '../terminal.js';
import {
  createAppServerOutputState,
  finishAppServerOutput,
  renderAppServerEvent,
} from './event-renderer.js';
import { WorkingIndicator } from './working-indicator.js';

interface ActiveTurn {
  interruptRequested: boolean;
  turnId?: string;
  workingIndicator: WorkingIndicator;
}

export class TurnRunner {
  private activeTurn?: ActiveTurn;

  constructor(
    private readonly state: CliState,
    private readonly client: AppServerClient,
    private readonly terminal: Terminal,
  ) {}

  get isActive(): boolean {
    return this.activeTurn !== undefined;
  }

  get workingIndicator(): WorkingIndicator | undefined {
    return this.activeTurn?.workingIndicator;
  }

  interrupt(): boolean {
    const activeTurn = this.activeTurn;
    if (!activeTurn) {
      return false;
    }
    if (activeTurn.interruptRequested) {
      return true;
    }

    activeTurn.interruptRequested = true;
    activeTurn.workingIndicator.hide();
    this.terminal.write('\n[interrupting turn]\n');
    if (activeTurn.turnId && this.state.threadId) {
      void interruptTurn(this.client, this.state.threadId, activeTurn.turnId).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        this.terminal.writeError(`Interrupt failed: ${message}\n`);
      });
    }
    return true;
  }

  async run(input: string): Promise<void> {
    if (this.activeTurn) {
      throw new Error('A Codex turn is already running');
    }

    const workingIndicator = new WorkingIndicator(this.terminal);
    const activeTurn: ActiveTurn = { interruptRequested: false, workingIndicator };
    const output = createAppServerOutputState(this.terminal, () => workingIndicator.hide());
    const bufferedEvents: AppServerEvent[] = [];

    this.activeTurn = activeTurn;
    this.terminal.write('\n');
    workingIndicator.start();

    let resolveCompletion: (params: TurnCompletedParams) => void = () => undefined;
    let rejectCompletion: (error: Error) => void = () => undefined;
    const completion = new Promise<TurnCompletedParams>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    let rejectDisconnected: (error: Error) => void = () => undefined;
    const disconnected = new Promise<never>((_resolve, reject) => {
      rejectDisconnected = reject;
    });

    const handleEvent = (event: AppServerEvent): void => {
      if (!activeTurn.turnId) {
        bufferedEvents.push(event);
        return;
      }
      if (!belongsToActiveTurn(event, this.state.threadId, activeTurn.turnId)) {
        return;
      }
      if (event.type === 'tokenUsage') {
        this.state.tokenUsage = event.tokenUsage;
        return;
      }
      if (event.type === 'turnCompleted') {
        resolveCompletion(event.completion);
        return;
      }
      if (event.type === 'protocolError') {
        rejectCompletion(new Error(event.message));
        return;
      }

      renderAppServerEvent(event, output);
      if (!output.openLine) {
        workingIndicator.show();
      }
    };

    const unsubscribeNotification = this.client.onNotification(notification => {
      const event = decodeAppServerEvent(notification);
      if (event) {
        handleEvent(event);
      }
    });
    const unsubscribeExit = this.client.onExit(rejectDisconnected);

    try {
      activeTurn.turnId = await Promise.race([
        startTurn(this.client, this.state, input),
        disconnected,
      ]);
      for (const event of bufferedEvents) {
        handleEvent(event);
      }
      if (activeTurn.interruptRequested && this.state.threadId) {
        await interruptTurn(this.client, this.state.threadId, activeTurn.turnId);
      }

      const completed = await Promise.race([completion, disconnected]);
      workingIndicator.hide();
      finishAppServerOutput(output);

      if (!output.streamedText) {
        const finalText = findFinalAgentMessage(completed);
        if (finalText) {
          this.terminal.write(`agent> ${finalText}\n`);
        }
      }
      if (completed.turn.status === 'failed' && !output.errorDisplayed) {
        throw new Error(completed.turn.error?.message || 'Codex turn failed');
      }
    } finally {
      unsubscribeNotification();
      unsubscribeExit();
      finishAppServerOutput(output);
      workingIndicator.stop();
      this.activeTurn = undefined;
    }
  }
}

function belongsToActiveTurn(
  event: AppServerEvent,
  threadId: string | undefined,
  turnId: string,
): boolean {
  return !(
    (threadId && event.threadId && event.threadId !== threadId) ||
    (event.turnId && event.turnId !== turnId)
  );
}

function findFinalAgentMessage(completed: TurnCompletedParams): string {
  const messages = (completed.turn.items || []).filter(item => item.type === 'agentMessage');
  const last = messages.at(-1);
  return last?.text || '';
}
